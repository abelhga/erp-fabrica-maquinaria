// Precarga de planos desde el inventario de la carpeta de ingeniería en Drive.
//
// Toma el recorrido de la carpeta (nodos.jsonl: un objeto por archivo o carpeta,
// con id, parentId y title) y el cruce contra el catálogo (cruce.json y
// cruce_archivos.tsv), y escribe un SQL que da de alta como BORRADOR:
//   - la carpeta de diseño de cada modelo que liga con un solo equipo;
//   - cada PDF de plano cuyo nombre liga con un solo equipo o componente.
// Nada queda vigente: ingeniería revisa cada uno y lo aprueba desde la pantalla.
//
//   node scripts/precargar-planos.mjs <carpeta del inventario> > precarga.sql
//   psql … con la sesión de un usuario de ingeniería (nuevo_documento_tecnico revisa el permiso)
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2];
if (!dir) { console.error("Uso: node scripts/precargar-planos.mjs <carpeta con nodos.jsonl, cruce.json y cruce_archivos.tsv>"); process.exit(1); }

const nodos = readFileSync(join(dir, "nodos.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const hijos = new Map();
for (const n of nodos) hijos.set(n.parentId, [...(hijos.get(n.parentId) ?? []), n]);
const buscar = (padre, titulo) => (hijos.get(padre) ?? []).filter((h) => h.title.trim() === titulo.trim());
const maquinaria = nodos.find((n) => n.title === "MAQUINARIA");
const cruce = JSON.parse(readFileSync(join(dir, "cruce.json"), "utf8"));

const filas = [];
for (const [familia, modelo, estado, claves] of cruce.carpetas_modelo) {
  if (estado !== "unico" || claves.length !== 1) continue;
  const f = buscar(maquinaria.id, familia)[0];
  const m = f && buscar(f.id, modelo)[0];
  if (m) filas.push(["carpeta", claves[0], `Carpeta de diseño: ${modelo}`, `https://drive.google.com/drive/folders/${m.id}`]);
}
const tsv = readFileSync(join(dir, "cruce_archivos.tsv"), "utf8").split("\n").filter(Boolean);
const cab = tsv.shift().split("\t");
for (const linea of tsv) {
  const r = Object.fromEntries(linea.split("\t").map((v, i) => [cab[i], v]));
  if (r.estado !== "por_nombre_unico" || r.tipo !== "PDF" || r.claves.includes(",")) continue;
  let nodo = maquinaria;
  for (const parte of r.carpeta.split("/").slice(1)) { nodo = nodo && buscar(nodo.id, parte)[0]; }
  const archivo = nodo && buscar(nodo.id, r.titulo)[0];
  if (archivo) filas.push(["plano", r.claves, r.titulo.replace(/\.[^.]+$/, ""), `https://drive.google.com/file/d/${archivo.id}/view`]);
}

const lit = (s) => `'${s.replaceAll("'", "''")}'`;
console.log("-- Borradores de planos y carpetas de diseño ligados desde el inventario de Drive.");
for (const [tipo, clave, titulo, url] of filas) {
  console.log(`select nuevo_documento_tecnico((select id from articulos where clave = ${lit(clave)}), null, ${lit(tipo)}, ${lit(titulo)}, ${lit(url)}, `
    + `'Ligado desde el inventario de Drive: confirmar que es el vigente') where exists (select 1 from articulos where clave = ${lit(clave)}) `
    + `and not exists (select 1 from documentos_tecnicos where drive_url = ${lit(url)});`);
}
console.error(`${filas.length} borradores (${filas.filter((f) => f[0] === "carpeta").length} carpetas, ${filas.filter((f) => f[0] === "plano").length} planos)`);

// Construye los mapas del BI (public/geo/) y el catálogo de municipios
// (supabase/datos/municipios.json) a partir del Marco Geoestadístico de INEGI 2023
// (shapefiles de CONABIO convertidos a GeoJSON por PhantomInsights/mexico-geojson, MIT).
//
//   node scripts/construir-mapas.mjs [carpeta de trabajo]
//
// Las rutas salen ya proyectadas (cónica conforme de Lambert de INEGI, EPSG:6372) y
// escaladas a un lienzo de 1000 de ancho: el navegador solo dibuja <path d>, sin
// librerías de mapas ni proyecciones. Un archivo nacional con los 32 estados y uno
// por estado con sus municipios, que se baja solo al entrar a ese estado.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const trabajo = process.argv[2] ?? "/tmp/erp-mapas";
const repo = new URL("..", import.meta.url).pathname;
const crudos = join(trabajo, "crudos");
mkdirSync(crudos, { recursive: true });

// 1. Los 32 estados con sus municipios (resolución completa, ~165 MB).
const FUENTE = "https://raw.githubusercontent.com/PhantomInsights/mexico-geojson/main/2023/states/";
const ESTADOS = ["Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila de Zaragoza", "Colima", "Durango", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco",
  "Michoacán de Ocampo", "Morelos", "México", "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo",
  "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz de Ignacio de la Llave",
  "Yucatán", "Zacatecas"];
for (const e of ESTADOS) {
  const destino = join(crudos, `${e}.json`);
  if (existsSync(destino) && statSync(destino).size > 1000) continue;
  console.log(`Bajando ${e}…`);
  execFileSync("curl", ["-sf", "-m", "180", "-o", destino, FUENTE + encodeURIComponent(`${e}.json`)]);
}

// 2. Unir, proyectar y simplificar con mapshaper (municipios al 4 %, estados al 0.8 %).
const PROY = "+proj=lcc +lat_1=17.5 +lat_2=29.5 +lat_0=12 +lon_0=-102 +x_0=2500000 +y_0=0 +ellps=GRS80 +units=m +no_defs";
const ms = (...a) => execFileSync("npx", ["--yes", "mapshaper@0.6", "-quiet", ...a], { stdio: "inherit" });
// Siempre desde los originales: pasar por un TopoJSON intermedio cuantiza las coordenadas y
// los bordes salían escalonados. dissolve2 (y no dissolve) cierra las astillas entre
// municipios, que en el mapa nacional se veían como motas blancas.
const entrada = ["-i", ...ESTADOS.map((e) => join(crudos, `${e}.json`)), "combine-files", "encoding=utf8", "-merge-layers", "force",
  "-filter-fields", "CVEGEO,CVE_ENT,CVE_MUN,NOMGEO,NOM_ENT", "-proj", PROY];
ms(...entrada, "-simplify", "4%", "keep-shapes", "-o", "format=geojson", "precision=10", join(trabajo, "mun.json"), "force");
ms(...entrada, "-dissolve2", "CVE_ENT", "copy-fields=NOM_ENT", "-simplify", "0.8%", "keep-shapes",
  "-o", "format=geojson", "precision=10", join(trabajo, "est.json"), "force");

// 3. Rutas SVG con coordenadas relativas (pesan ~40 % menos que absolutas).
const est = JSON.parse(readFileSync(join(trabajo, "est.json"), "utf8"));
const mun = JSON.parse(readFileSync(join(trabajo, "mun.json"), "utf8"));
const poligonos = (g) => (g.type === "MultiPolygon" ? g.coordinates : [g.coordinates]);
let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
for (const f of est.features) for (const p of poligonos(f.geometry)) for (const r of p) for (const [x, y] of r) {
  minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
}
const k = 1000 / (maxx - minx);
const alto = Math.round((maxy - miny) * k * 10) / 10;
const tx = ([x, y]) => [(x - minx) * k, (maxy - y) * k];
const num = (v) => String(Number(v.toFixed(4)));
function ruta(g, decimales, conHuecos) {
  const f = 10 ** decimales;
  let s = "";
  for (const p of poligonos(g)) {
    // Ningún estado tiene enclaves: un anillo interior en la unión sería una astilla.
    for (const anillo of conHuecos ? p : [p[0]]) {
      const q = [];
      for (const pt of anillo.map(tx)) {
        const r = [Math.round(pt[0] * f), Math.round(pt[1] * f)];
        if (!q.length || r[0] !== q.at(-1)[0] || r[1] !== q.at(-1)[1]) q.push(r);
      }
      if (q.length < 3) continue;
      s += `M${num(q[0][0] / f)} ${num(q[0][1] / f)}`;
      for (let i = 1; i < q.length; i++) s += `l${num((q[i][0] - q[i - 1][0]) / f)} ${num((q[i][1] - q[i - 1][1]) / f)}`;
      s += "z";
    }
  }
  return s.replaceAll(" -", "-");
}
function caja(g) {
  const pts = poligonos(g).flatMap((p) => p[0].map(tx));
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}
/** Centroide del anillo exterior más grande: ahí van la etiqueta o la burbuja. */
function centro(g) {
  let mejor = null;
  for (const p of poligonos(g)) {
    const r = p[0].map(tx);
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < r.length; i++) {
      const [x0, y0] = r[i], [x1, y1] = r[(i + 1) % r.length];
      const c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    }
    if (!a) continue;
    a /= 2;
    if (!mejor || Math.abs(a) > mejor[0]) mejor = [Math.abs(a), cx / (6 * a), cy / (6 * a)];
  }
  return [Math.round(mejor[1] * 100) / 100, Math.round(mejor[2] * 100) / 100];
}
const redondea = (v, d) => v.map((x) => Math.round(x * 10 ** d) / 10 ** d);

const salida = join(repo, "public/geo");
mkdirSync(join(salida, "municipios"), { recursive: true });
const FUENTE_TEXTO = "INEGI, Marco Geoestadístico 2023 (vía CONABIO y PhantomInsights/mexico-geojson, licencia MIT). Simplificado.";
writeFileSync(join(salida, "estados.json"), JSON.stringify({
  fuente: FUENTE_TEXTO, ancho: 1000, alto,
  estados: est.features.sort((a, b) => a.properties.CVE_ENT.localeCompare(b.properties.CVE_ENT)).map((f) => ({
    cve: f.properties.CVE_ENT, nombre: f.properties.NOM_ENT, d: ruta(f.geometry, 1, false), c: centro(f.geometry), caja: redondea(caja(f.geometry), 1),
  })),
}));
const porEstado = new Map();
for (const f of mun.features) porEstado.set(f.properties.CVE_ENT, [...(porEstado.get(f.properties.CVE_ENT) ?? []), f]);
const catalogo = [];
for (const [cve, fs] of porEstado) {
  fs.sort((a, b) => a.properties.CVEGEO.localeCompare(b.properties.CVEGEO));
  const cajas = fs.map((f) => caja(f.geometry));
  writeFileSync(join(salida, "municipios", `${cve}.json`), JSON.stringify({
    cve, nombre: fs[0].properties.NOM_ENT, fuente: FUENTE_TEXTO,
    caja: redondea([Math.min(...cajas.map((c) => c[0])), Math.min(...cajas.map((c) => c[1])), Math.max(...cajas.map((c) => c[2])), Math.max(...cajas.map((c) => c[3]))], 2),
    municipios: fs.map((f) => ({ cve: f.properties.CVEGEO, nombre: f.properties.NOMGEO, d: ruta(f.geometry, 2, true), c: centro(f.geometry) })),
  }));
  for (const f of fs) catalogo.push([f.properties.CVEGEO, f.properties.CVE_ENT, f.properties.NOMGEO, f.properties.NOM_ENT]);
}
mkdirSync(join(repo, "supabase/datos"), { recursive: true });
catalogo.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync(join(repo, "supabase/datos/municipios.json"), JSON.stringify(catalogo));
console.log(`${est.features.length} estados, ${catalogo.length} municipios → public/geo/ y supabase/datos/municipios.json`);

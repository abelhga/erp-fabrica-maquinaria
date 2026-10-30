// El manual del ERP para el asistente: los textos del modo tutorial (manual-datos.ts, generado
// con `npm run manual`) y una búsqueda por palabras. Sin esto el asistente solo sabía consultar
// datos, y a «¿cómo agrego horas extra a una cuadrilla?» contestaba adivinando una pantalla.
// Cada texto se filtra con los permisos de quien pregunta: lo que no puede abrir, no se lo explica.
import { CONCEPTOS_MANUAL, PANTALLAS_MANUAL } from "./manual-datos.ts";

export interface PantallaManual { ruta: string; nombre: string; modulos: string[]; nivel: number; texto: string[] }
export interface ConceptoManual { clave: string; modulos: string[]; texto: string }
export type Permisos = Record<string, number>;

const normal = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Lo que no ayuda a encontrar nada: «cómo», «agrego», «cuando»… y las conjugaciones de «hacer».
const VACIAS = new Set(("a al algo asi como con cual cuales cuando de del donde el ella en es esa ese esta este hace hacen hacer hago hay la las le lo los " +
  "me mi mis nos o para pero por puedo que se si sin solo su sus te tengo un una uno y ya agrego agregar pongo poner quiero saber " +
  "debo deberia necesito puede pueden").split(" "));

/** Palabras clave, sin acentos y en singular («horas extras» → «hora», «extra»). */
export function palabras(texto: string): string[] {
  return [...new Set(normal(texto).split(/[^a-z0-9ñ]+/).filter((p) => p.length > 1 && !VACIAS.has(p))
    .map((p) => (p.length > 5 && p.endsWith("es") ? p.slice(0, -2) : p.length > 4 && p.endsWith("s") ? p.slice(0, -1) : p)))];
}

const visible = (modulos: string[], nivel: number, permisos: Permisos) => modulos.length === 0 || modulos.some((m) => (permisos[m] ?? 0) >= nivel);

function puntos(claves: string[], titulo: string, cuerpo: string): number {
  const t = normal(titulo), c = normal(cuerpo);
  let n = 0, distintas = 0;
  for (const p of claves) {
    const enTitulo = t.includes(p), veces = Math.min(c.split(p).length - 1, 3);
    if (enTitulo || veces) distintas++;
    n += (enTitulo ? 4 : 0) + veces;
  }
  // Que salgan juntas pesa más que que una se repita mucho («hora» sola está en todos lados).
  return n * distintas;
}

/** Lo que dice el manual sobre una pregunta: hasta 4 pantallas y 6 conceptos que esa persona puede ver. */
export function buscarEnManual(pregunta: string, permisos: Permisos,
  datos: { pantallas: PantallaManual[]; conceptos: ConceptoManual[] } = { pantallas: PANTALLAS_MANUAL, conceptos: CONCEPTOS_MANUAL }) {
  const claves = palabras(pregunta);
  if (!claves.length) return { pantallas: [], conceptos: [], nota: "Escribe palabras clave de lo que quieres hacer." };
  const pantallas = datos.pantallas.filter((p) => visible(p.modulos, p.nivel, permisos))
    .map((p) => ({ p, n: puntos(claves, p.nombre, p.texto.join(" ")) })).filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, 4)
    .map(({ p }) => ({ pantalla: p.nombre, ruta: p.ruta, como_se_usa: p.texto.join("\n").slice(0, 3500) }));
  const conceptos = datos.conceptos.filter((c) => visible(c.modulos, 1, permisos))
    .map((c) => ({ c, n: puntos(claves, c.clave, c.texto) })).filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n).slice(0, 6)
    .map(({ c }) => ({ concepto: c.clave, que_es: c.texto }));
  return {
    pantallas, conceptos,
    nota: pantallas.length || conceptos.length ? "Rutas con :id son la ficha de un registro: manda a la lista y di que abra el registro."
      : "El manual no habla de eso (o es de una pantalla que esta persona no puede abrir).",
  };
}

/** Las rutas a las que se puede mandar a alguien con un enlace (las que no son la ficha de un registro). */
export const RUTAS_MANUAL = PANTALLAS_MANUAL.map((p) => p.ruta).filter((r) => !r.includes(":"));

import { CALENDARIO, INICIO, MENU, PENDIENTES, REVISION, SEMANA } from "@/navegacion";
import { SECCIONES } from "./pantallas";
import { SECCIONES_GLOSARIO } from "./glosario";

/**
 * El tutorial convertido en el manual que consulta el asistente. Así, cuando alguien pregunta
 * «¿cómo agrego horas extra a una cuadrilla?», el asistente contesta con lo mismo que dice la
 * pantalla en modo tutorial, en vez de adivinar. Se genera a un archivo dentro de la función
 * (`npm run manual`) porque la función no puede leer `src/`; `manual.test.ts` falla si el
 * tutorial cambió y el archivo no se volvió a generar.
 *
 * Cada texto lleva los módulos que hay que poder ver para leerlo, los mismos que pide la pantalla:
 * el manual no le explica a ventas la fórmula del precio porque ventas no abre el costeo.
 */
export interface PantallaManual { ruta: string; nombre: string; modulos: string[]; nivel: number; texto: string[] }
export interface ConceptoManual { clave: string; modulos: string[]; texto: string }

// Las de todos: el menú les pone «ventas» solo por ponerles algo (Shell no lo revisa).
const DE_TODOS = new Set([INICIO.ruta, PENDIENTES.ruta, REVISION.ruta, CALENDARIO.ruta]);

// El glosario va por sección; cada una con los módulos de su sección del menú.
const MODULOS_GLOSARIO: Record<keyof typeof SECCIONES_GLOSARIO, string[]> = {
  GENERAL: [], VENTAS: ["ventas", "leads", "catalogo", "mercadolibre"], COSTEO: ["costeo", "margenes"], COMPRAS: ["compras"], ANALISIS: ["analisis"],
  ALMACEN: ["inventario", "envios"], IMPORTACIONES: ["importaciones"], PRODUCCION: ["produccion", "procesos"],
  SERVICIO: ["servicio", "mantenimiento"], ADMINISTRACION: ["rrhh", "nomina", "objetivos", "finanzas", "caja_chica", "mi_desempeno"],
  SISTEMA: ["admin"],
};

const ENTRADAS = [...MENU.flatMap((s) => s.entradas), INICIO, PENDIENTES, REVISION, CALENDARIO, SEMANA];

/** La entrada del menú de una ruta: la misma o la más larga que la contiene (`/ventas/pedidos/:id` → Pedidos). */
function entradaDe(ruta: string) {
  const exacta = ENTRADAS.find((e) => e.ruta === ruta);
  if (exacta) return { e: exacta, resto: "" };
  const padre = ENTRADAS.filter((e) => e.ruta !== "/" && ruta.startsWith(e.ruta + "/")).sort((a, b) => b.ruta.length - a.ruta.length)[0];
  if (padre) return { e: padre, resto: ruta.slice(padre.ruta.length + 1) };
  // Sin padre en el menú (la hoja de salida, un documento de RRHH): la sección de su primer tramo.
  const tramo = ruta.split("/")[1];
  const vecina = ENTRADAS.find((e) => e.ruta.split("/")[1] === tramo && e.ruta !== "/");
  return vecina ? { e: vecina, resto: ruta.slice(1) } : null;
}

const legible = (resto: string) => resto.split("/").map((t) => (t.startsWith(":") ? "ficha" : t.replace(/-/g, " "))).join(" › ");

export function armarManual(): { pantallas: PantallaManual[]; conceptos: ConceptoManual[] } {
  const pantallas = Object.values(SECCIONES).flatMap((seccion) => Object.entries(seccion)).map(([ruta, texto]) => {
    const m = entradaDe(ruta);
    const publica = DE_TODOS.has(ruta) || !m;
    return {
      ruta,
      nombre: m ? (m.resto ? `${m.e.texto} › ${legible(m.resto)}` : m.e.texto) : legible(ruta.slice(1)),
      modulos: publica ? [] : [m!.e.modulo],
      nivel: publica ? 1 : m!.e.nivel ?? 1,
      texto,
    };
  }).sort((a, b) => a.ruta.localeCompare(b.ruta));
  const conceptos = (Object.entries(SECCIONES_GLOSARIO) as [keyof typeof SECCIONES_GLOSARIO, Record<string, string>][])
    .flatMap(([seccion, defs]) => Object.entries(defs).map(([clave, texto]) => ({ clave, modulos: MODULOS_GLOSARIO[seccion], texto })))
    .sort((a, b) => a.clave.localeCompare(b.clave));
  return { pantallas, conceptos };
}

/** El archivo que va dentro de la función del asistente. */
export function archivoManual(): string {
  const { pantallas, conceptos } = armarManual();
  return `// Generado desde src/tutorial con \`npm run manual\`. No se edita a mano: se cambia el tutorial.
import type { ConceptoManual, PantallaManual } from "./manual.ts";

export const PANTALLAS_MANUAL: PantallaManual[] = ${JSON.stringify(pantallas, null, 1)};

export const CONCEPTOS_MANUAL: ConceptoManual[] = ${JSON.stringify(conceptos, null, 1)};
`;
}

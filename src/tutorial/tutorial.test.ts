import { describe, expect, it } from "vitest";
import { CALENDARIO, INICIO, MENU, PENDIENTES, REVISION, SEMANA } from "@/navegacion";
import { PANTALLAS, SECCIONES, ayudaDe, textoAyuda } from "./pantallas";
import { GLOSARIO, SECCIONES_GLOSARIO } from "./glosario";

/**
 * El modo tutorial se queda viejo sin que nadie lo note: una pantalla nueva sin su texto
 * simplemente no muestra nada. Estas pruebas convierten ese olvido en una prueba roja.
 */

// Pantallas del menú que se abren fuera del marco (sin encabezado, así que sin botón de
// tutorial): la tablet del piso y la TV. Si alguna entra al marco, sale de aquí y pide su texto.
const SIN_MARCO = new Set(["/piso", "/produccion/terminal", "/servicio/reportar"]);

describe("modo tutorial", () => {
  const rutas = [INICIO, PENDIENTES, REVISION, CALENDARIO, SEMANA, ...MENU.flatMap((s) => s.entradas)].map((e) => e.ruta);

  it.each(rutas.filter((r) => !SIN_MARCO.has(r)))("la pantalla %s explica para qué sirve", (ruta) => {
    const ayuda = ayudaDe(ruta);
    expect(ayuda, `falta su texto en src/tutorial/pantallas/`).not.toBeNull();
    expect(textoAyuda(ayuda!)[0].trim().length).toBeGreaterThan(0);
  });

  it("los detalles encuentran su texto por el patrón con :id", () => {
    for (const patron of Object.keys(PANTALLAS).filter((p) => p.includes(":"))) {
      const ejemplo = patron.replace(/:[^/]+/g, "123");
      expect(ayudaDe(ejemplo), patron).toBe(PANTALLAS[patron]);
    }
  });

  it("ninguna sección pisa la ruta de otra", () => {
    const vistas = new Map<string, string>();
    for (const [seccion, mapa] of Object.entries(SECCIONES)) {
      for (const ruta of Object.keys(mapa)) {
        expect(vistas.get(ruta), `${ruta} está en ${vistas.get(ruta)} y en ${seccion}`).toBeUndefined();
        vistas.set(ruta, seccion);
      }
    }
  });

  it("ninguna sección del glosario pisa la definición de otra", () => {
    const vistas = new Map<string, string>();
    for (const [seccion, mapa] of Object.entries(SECCIONES_GLOSARIO)) {
      for (const llave of Object.keys(mapa)) {
        expect(vistas.get(llave), `"${llave}" está en ${vistas.get(llave)} y en ${seccion}`).toBeUndefined();
        vistas.set(llave, seccion);
      }
    }
  });

  // Arriba de la pantalla va poco a propósito: lo que no cabe aquí va en «Ver más» o en el globo de
  // la cosa. Si un recuadro vuelve a crecer, nadie lo lee (así estaban: hasta 800 palabras).
  const palabras = (t: string) => t.trim().split(/\s+/).length;
  it("cada recuadro es corto: una frase de 30 palabras y hasta 3 pasos de 18", () => {
    for (const [ruta, a] of Object.entries(PANTALLAS)) {
      expect(Array.isArray(a), `${ruta} sigue siendo una lista de párrafos`).toBe(false);
      expect(palabras(a.resumen), `${ruta}: resumen`).toBeLessThanOrEqual(30);
      expect((a.pasos ?? []).length, `${ruta}: pasos`).toBeLessThanOrEqual(3);
      for (const p of a.pasos ?? []) expect(palabras(p), `${ruta}: paso «${p}»`).toBeLessThanOrEqual(18);
    }
  });

  it("ningún texto viene vacío", () => {
    for (const [ruta, ayuda] of Object.entries(PANTALLAS)) {
      for (const p of textoAyuda(ayuda)) expect(p.trim(), ruta).not.toBe("");
    }
    for (const [llave, texto] of Object.entries(GLOSARIO)) expect((texto as string).trim(), llave).not.toBe("");
  });
});

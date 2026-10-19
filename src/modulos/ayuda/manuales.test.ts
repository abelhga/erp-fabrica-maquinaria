import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MANUALES, armarManual } from "./manuales";

// La copia que sirve el ERP se arma a mano (`npm run manuales`): si alguien cambia un
// manual en docs/ y no la vuelve a armar, la pantalla de ayuda enseña la versión vieja.
const leer = (...p: string[]) => readFileSync(path.resolve(__dirname, "../../..", ...p), "utf8");

describe("manuales del ERP", () => {
  it.each(MANUALES.map((m) => m.clave))("public/manuales/%s.html está al día con docs/", (clave) => {
    expect(leer("public/manuales", `${clave}.html`), "corre npm run manuales").toBe(armarManual(leer("docs/manuales", `${clave}.html`)));
  });

  it("las ligas entre manuales abren la pantalla de ayuda, no el artefacto", () => {
    for (const m of MANUALES) expect(leer("public/manuales", `${m.clave}.html`)).not.toMatch(/claude\.ai\/artifact/);
  });

  // Una comilla mal cerrada en una práctica deja muerto todo el manual sin que se note a simple vista.
  it.each(MANUALES.map((m) => m.clave))("el script de %s se puede leer", (clave) => {
    const html = leer("docs/manuales", `${clave}.html`);
    const js = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
    expect(() => new Function(js)).not.toThrow();
  });

  // Los archivos se sirven sin sesión, como el resto del sitio: nada que solo deba ver
  // márgenes (el factor del precio de componentes) puede ir en un manual.
  it("ningún manual trae el factor del precio", () => {
    for (const m of MANUALES) expect(leer("docs/manuales", `${m.clave}.html`)).not.toMatch(/0\.70|÷ ?0\.7/);
  });
});

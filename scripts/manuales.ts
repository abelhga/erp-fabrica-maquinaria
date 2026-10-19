// Arma public/manuales/*.html desde docs/manuales/*.html para que el ERP los sirva en su
// pantalla de ayuda. Se corre después de cambiar un manual: `npm run manuales`.
// La prueba src/modulos/ayuda/manuales.test.ts falla si alguna copia quedó vieja.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MANUALES, armarManual } from "../src/modulos/ayuda/manuales";

const raiz = path.resolve(import.meta.dirname, "..");
mkdirSync(path.join(raiz, "public/manuales"), { recursive: true });
for (const m of MANUALES) {
  const fuente = readFileSync(path.join(raiz, "docs/manuales", `${m.clave}.html`), "utf8");
  writeFileSync(path.join(raiz, "public/manuales", `${m.clave}.html`), armarManual(fuente));
  console.log(`public/manuales/${m.clave}.html`);
}

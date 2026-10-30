// Escribe el manual del asistente desde el tutorial (src/tutorial). Se corre con `npm run manual`
// cada vez que cambia el tutorial; src/tutorial/manual.test.ts avisa si se olvidó.
import { writeFileSync } from "node:fs";
import { archivoManual } from "../src/tutorial/manual";

const destino = new URL("../supabase/functions/asistente/manual-datos.ts", import.meta.url);
writeFileSync(destino, archivoManual());
console.log(`✔ ${destino.pathname}`);

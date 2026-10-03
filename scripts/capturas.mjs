// Abre la app en Chromium, entra con un usuario de prueba y toma capturas.
// Uso: node scripts/capturas.mjs <correo> <ruta1> [ruta2…]   (servidor en APP_URL, por defecto :5173)
// Las capturas quedan en capturas/<usuario>-<ruta>.png. Muestra errores de consola: una pantalla
// que "se ve bien" pero tira errores no está bien.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const [correo = "direccion@hegamex.com", ...rutas] = process.argv.slice(2);
const base = process.env.APP_URL ?? "http://localhost:5173";
const ancho = Number(process.env.ANCHO ?? 1440), alto = Number(process.env.ALTO ?? 900);
mkdirSync("capturas", { recursive: true });

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const pag = await nav.newPage({ viewport: { width: ancho, height: alto }, colorScheme: process.env.OSCURO ? "dark" : "light" });
const errores = [];
pag.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
pag.on("pageerror", (e) => errores.push(e.message));

await pag.goto(base);
if (process.env.OSCURO) await pag.evaluate(() => localStorage.setItem("tema", "oscuro"));
await pag.getByText("Entrar con correo y contraseña").click();
await pag.getByLabel("Correo").fill(correo);
await pag.getByLabel("Contraseña").fill("hegamex-local");
await pag.getByRole("button", { name: "Entrar", exact: true }).click();
await pag.waitForTimeout(1500);

for (const ruta of rutas.length ? rutas : ["/"]) {
  await pag.goto(base + ruta);
  await pag.waitForLoadState("networkidle");
  await pag.waitForTimeout(Number(process.env.ESPERA ?? 800));
  const nombre = `capturas/${correo.split("@")[0]}${ruta.replace(/[/?=&]+/g, "-").replace(/-$/, "") || "-inicio"}${process.env.OSCURO ? "-oscuro" : ""}.png`;
  await pag.screenshot({ path: nombre, fullPage: !!process.env.COMPLETA });
  console.log("📸", nombre);
}
if (errores.length) { console.log("⚠ errores de consola:\n  " + [...new Set(errores)].join("\n  ")); }
await nav.close();
